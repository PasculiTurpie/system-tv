// pages/Ird/IrdForm.jsx
import { Formik, Field, Form } from "formik";
import { Link } from "react-router-dom";
import styles from "./Ird.module.css";
import * as Yup from "yup";
import Swal from "sweetalert2";
import api from "../../utils/api";
import { ipMulticastRegex, ipVideoMulticast } from "../../utils/regexValidate";

// ------------------------ VALIDACIONES ------------------------
const IrdSchema = Yup.object().shape({
    nombreIrd: Yup.string().required("Campo obligatorio"),
    ipAdminIrd: Yup.string()
        .required("Campo obligatorio")
        .matches(/^172\.19\.\d{1,3}\.\d{1,3}$/, "Ingresa una ip válida"),
    marcaIrd: Yup.string().required("Campo obligatorio"),
    modelIrd: Yup.string().required("Campo obligatorio"),
    versionIrd: Yup.string().required("Campo obligatorio"),
    uaIrd: Yup.string().required("Campo obligatorio"),
    tidReceptor: Yup.string().required("Campo obligatorio"),
    typeReceptor: Yup.string().required("Campo obligatorio"),
    feqReceptor: Yup.string().required("Campo obligatorio"),
    symbolRateIrd: Yup.string().required("Campo obligatorio"),
    fecReceptorIrd: Yup.string().required("Campo obligatorio"),
    modulationReceptorIrd: Yup.string().required("Campo obligatorio"),
    rellOfReceptor: Yup.string().required("Campo obligatorio"),
    nidReceptor: Yup.string().required("Campo obligatorio"),
    cvirtualReceptor: Yup.string().required("Campo obligatorio"),
    vctReceptor: Yup.string().required("Campo obligatorio"),
    outputReceptor: Yup.string().required("Campo obligatorio"),
    swAdmin: Yup.string(),
    portSw: Yup.string(),
    multicastReceptor: Yup.string()
        .matches(ipMulticastRegex, "Debe ser una multicast válida")
        .required("Campo requerido"),
    ipVideoMulticast: Yup.string()
        .required("Campo obligatorio")
        .matches(ipVideoMulticast, "Debe ser una ip válida"),
    locationRow: Yup.string()
        .required("Campo obligatorio")
        .matches(/\d+/, "Ingrese un número"),
    locationCol: Yup.string()
        .required("Campo obligatorio")
        .matches(/\d+/, "Ingrese un número"),
});

// ------------------------ COMPONENTE ------------------------
import { useEffect, useState } from "react";

const IrdForm = () => {
    const [tipoMap, setTipoMap] = useState({}); // { 'ird': ObjectId, ... }
    const [loadingTipos, setLoadingTipos] = useState(false);

    // Carga inicial de tipos de equipo y construye un mapa por nombre (lowercase)
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                setLoadingTipos(true);
                const res = await api.getTipoEquipo(); // devuelve { data: [...] }
                const arr = res?.data || [];
                const map = {};
                for (const t of arr) {
                    if (t?.tipoNombre && t?._id) {
                        map[String(t.tipoNombre).toLowerCase()] = t._id;
                    }
                }
                if (mounted) setTipoMap(map);
            } catch (err) {
                console.warn("No se pudo cargar TipoEquipo:", err?.response?.data || err);
            } finally {
                if (mounted) setLoadingTipos(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    // Asegura que exista el tipo 'ird' y devuelve su ObjectId
    const ensureTipoId = async (name = "ird") => {
        const key = String(name).toLowerCase();
        if (tipoMap[key]) return tipoMap[key];

        // Si no existe, intentamos crearlo
        try {
            const created = await api.createTipoEquipo({ tipoNombre: name });
            const id = created?._id;
            if (id) {
                setTipoMap((prev) => ({ ...prev, [key]: id }));
                return id;
            }
        } catch (error) {
            console.warn("No se pudo crear TipoEquipo 'ird'", error);
            // Si falla crear, reintenta refrescar el listado por si existe
            try {
                const res = await api.getTipoEquipo();
                const arr = res?.data || [];
                const found = arr.find(
                    (t) => String(t?.tipoNombre).toLowerCase() === key
                );
                if (found?._id) {
                    setTipoMap((prev) => ({ ...prev, [key]: found._id }));
                    return found._id;
                }
            } catch (refreshError) {
                console.warn("No se pudo refrescar TipoEquipo tras error", refreshError);
            }
            throw new Error("No existe ni se pudo crear el TipoEquipo 'ird'.");
        }
    };

    return (
        <>
            <div className="outlet-main">
                <nav aria-label="breadcrumb">
                    <ol className="breadcrumb">
                        <li className="breadcrumb-item">
                            <Link to="/listar-ird">Listar</Link>
                        </li>
                        <li className="breadcrumb-item active" aria-current="page">
                            Formulario
                        </li>
                    </ol>
                </nav>

                <Formik
                    initialValues={{
                        nombreIrd: "",
                        ipAdminIrd: "",
                        marcaIrd: "",
                        modelIrd: "",
                        versionIrd: "",
                        uaIrd: "",
                        tidReceptor: "",
                        typeReceptor: "",
                        feqReceptor: "",
                        symbolRateIrd: "",
                        fecReceptorIrd: "",
                        modulationReceptorIrd: "",
                        rellOfReceptor: "",
                        nidReceptor: "",
                        cvirtualReceptor: "",
                        vctReceptor: "",
                        outputReceptor: "",
                        swAdmin: "",
                        portSw: "",
                        multicastReceptor: "",
                        ipVideoMulticast: "",
                        locationRow: "",
                        locationCol: "",
                    }}
                    validationSchema={IrdSchema}
                    enableReinitialize={true}
                    onSubmit={async (values, { resetForm }) => {
                        if (loadingTipos) {
                            Swal.fire({
                                icon: "info",
                                title: "Cargando tipos de equipo…",
                                text: "Espera un momento e intenta nuevamente.",
                            });
                            return;
                        }

                        try {
                            // 1) Crear IRD
                            const ird = await api.createIrd(values); // devuelve el objeto IRD creado
                            const irdId = ird?._id;

                            // 2) Conseguir ObjectId del tipo 'ird'
                            const tipoIrdId = await ensureTipoId("ird");

                            // 3) Crear Equipo asociado (referenciando IRD)
                            let equipoOk = true;
                            let equipoMsg = "";
                            try {
                                await api.createEquipo({
                                    nombre: values.nombreIrd,
                                    marca: values.marcaIrd,
                                    modelo: values.modelIrd,
                                    tipoNombre: tipoIrdId, // OBLIGATORIO: ObjectId del tipo
                                    ip_gestion: values.ipAdminIrd,
                                    irdRef: irdId, // si tu schema de Equipo lo contempla
                                });
                                equipoMsg = "Equipo creado correctamente.";
                            } catch (bgErr) {
                                equipoOk = false;
                                equipoMsg =
                                    bgErr?.response?.data?.message ||
                                    "No se pudo crear Equipo desde IRD.";
                                console.warn("No se pudo crear Equipo:", bgErr?.response?.data || bgErr);
                            }

                            // 4) Feedback y reset
                            Swal.fire({
                                title: "IRD guardado",
                                icon: "success",
                                html: `
                  <div style="text-align:left">
                    <div><b>Nombre IRD:</b> ${values.nombreIrd}</div>
                    <div><b>Marca:</b> ${values.marcaIrd}</div>
                    <div><b>Modelo:</b> ${values.modelIrd}</div>
                    <div><b>IP Gestión:</b> ${values.ipAdminIrd}</div>
                    <hr/>
                    <div><b>Equipo:</b> ${equipoOk ? "Creado" : "No creado"}</div>
                    <div style="color:${equipoOk ? "#065f46" : "#991b1b"}">${equipoMsg}</div>
                  </div>
                `,
                            });
                            resetForm();
                        } catch (error) {
                            Swal.fire({
                                title: "Error",
                                icon: "error",
                                text: `No se pudo crear el IRD`,
                                footer: `${error?.response?.data?.message || error.message}`,
                            });
                        }
                    }}
                >
                    {({ errors, touched }) => (
                        <Form className={`form__add ${styles.formGrid}`}>
                            <h1 className="form__titulo">Ingresa un IRD</h1>

                            <div className={styles.rows__group}>
                                <div className={styles.columns__group}>
                                    <div className="form__group">
                                        <label htmlFor="nombreIrd" className="form__group-label">
                                            Nombre
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="Nombre IRD"
                                                name="nombreIrd"
                                            />
                                        </label>
                                        {errors.nombreIrd && touched.nombreIrd ? (
                                            <div className="form__group-error">
                                                {errors.nombreIrd}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="form__group">
                                        <label htmlFor="marcaIrd" className="form__group-label">
                                            Marca
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="Marca"
                                                name="marcaIrd"
                                            />
                                        </label>
                                        {errors.marcaIrd && touched.marcaIrd ? (
                                            <div className="form__group-error">
                                                {errors.marcaIrd}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="form__group">
                                        <label htmlFor="modelIrd" className="form__group-label">
                                            Modelo
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="Modelo"
                                                name="modelIrd"
                                            />
                                        </label>
                                        {errors.modelIrd && touched.modelIrd ? (
                                            <div className="form__group-error">
                                                {errors.modelIrd}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="form__group">
                                        <label htmlFor="ipAdminIrd" className="form__group-label">
                                            IP administración
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="172.19.x.x"
                                                name="ipAdminIrd"
                                            />
                                        </label>
                                        {errors.ipAdminIrd && touched.ipAdminIrd ? (
                                            <div className="form__group-error">
                                                {errors.ipAdminIrd}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="form__group">
                                        <label htmlFor="versionIrd" className="form__group-label">
                                            Versión
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="Versión"
                                                name="versionIrd"
                                            />
                                        </label>
                                        {errors.versionIrd && touched.versionIrd ? (
                                            <div className="form__group-error">
                                                {errors.versionIrd}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="form__group">
                                        <label htmlFor="uaIrd" className="form__group-label">
                                            UA
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="UA"
                                                name="uaIrd"
                                            />
                                        </label>
                                        {errors.uaIrd && touched.uaIrd ? (
                                            <div className="form__group-error">
                                                {errors.uaIrd}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                {/* ########################################## */}
                                <div className={styles.columns__group}>
                                    <div className="form__group">
                                        <label htmlFor="tidReceptor" className="form__group-label">
                                            TID
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="TID"
                                                name="tidReceptor"
                                            />
                                        </label>
                                        {errors.tidReceptor && touched.tidReceptor ? (
                                            <div className="form__group-error">
                                                {errors.tidReceptor}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="form__group">
                                        <label htmlFor="typeReceptor" className="form__group-label">
                                            Tipo receptor
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="Tipo"
                                                name="typeReceptor"
                                            />
                                        </label>
                                        {errors.typeReceptor && touched.typeReceptor ? (
                                            <div className="form__group-error">
                                                {errors.typeReceptor}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="form__group">
                                        <label htmlFor="feqReceptor" className="form__group-label">
                                            Frecuencia
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="Frecuencia"
                                                name="feqReceptor"
                                            />
                                        </label>
                                        {errors.feqReceptor && touched.feqReceptor ? (
                                            <div className="form__group-error">
                                                {errors.feqReceptor}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="form__group">
                                        <label htmlFor="symbolRateIrd" className="form__group-label">
                                            Symbol Rate
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="Symbol Rate"
                                                name="symbolRateIrd"
                                            />
                                        </label>
                                        {errors.symbolRateIrd && touched.symbolRateIrd ? (
                                            <div className="form__group-error">
                                                {errors.symbolRateIrd}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="form__group">
                                        <label htmlFor="fecReceptorIrd" className="form__group-label">
                                            FEC
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="FEC"
                                                name="fecReceptorIrd"
                                            />
                                        </label>
                                        {errors.fecReceptorIrd && touched.fecReceptorIrd ? (
                                            <div className="form__group-error">
                                                {errors.fecReceptorIrd}
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="form__group">
                                        <label htmlFor="swAdmin" className="form__group-label">
                                            SW Admin
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="SW Admin"
                                                name="swAdmin"
                                            />
                                        </label>
                                        {errors.swAdmin && touched.swAdmin ? (
                                            <div className="form__group-error">
                                                {errors.swAdmin}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                {/* ###################################### */}
                                <div className={styles.columns__group}>
                                    <div className="form__group">
                                        <label htmlFor="modulationReceptorIrd" className="form__group-label">
                                            Modulación
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="Modulación"
                                                name="modulationReceptorIrd"
                                            />
                                        </label>
                                        {errors.modulationReceptorIrd &&
                                            touched.modulationReceptorIrd ? (
                                            <div className="form__group-error">
                                                {errors.modulationReceptorIrd}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="form__group">
                                        <label htmlFor="rellOfReceptor" className="form__group-label">
                                            Roll Off
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="Roll Off"
                                                name="rellOfReceptor"
                                            />
                                        </label>
                                        {errors.rellOfReceptor && touched.rellOfReceptor ? (
                                            <div className="form__group-error">
                                                {errors.rellOfReceptor}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="form__group">
                                        <label htmlFor="nidReceptor" className="form__group-label">
                                            NID
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="NID"
                                                name="nidReceptor"
                                            />
                                        </label>
                                        {errors.nidReceptor && touched.nidReceptor ? (
                                            <div className="form__group-error">
                                                {errors.nidReceptor}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="form__group">
                                        <label htmlFor="cvirtualReceptor" className="form__group-label">
                                            Canal Virtual
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="Canal Virtual"
                                                name="cvirtualReceptor"
                                            />
                                        </label>
                                        {errors.cvirtualReceptor && touched.cvirtualReceptor ? (
                                            <div className="form__group-error">
                                                {errors.cvirtualReceptor}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="form__group">
                                        <label htmlFor="vctReceptor" className="form__group-label">
                                            VCT
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="VCT"
                                                name="vctReceptor"
                                            />
                                        </label>
                                        {errors.vctReceptor && touched.vctReceptor ? (
                                            <div className="form__group-error">
                                                {errors.vctReceptor}
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="form__group">
                                        <label htmlFor="portSw" className="form__group-label">
                                            SW Port
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="TID"
                                                name="portSw"
                                            />
                                        </label>
                                        {errors.portSw && touched.portSw ? (
                                            <div className="form__group-error">
                                                {errors.portSw}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                {/* ###################################### */}
                                <div className={styles.columns__group}>
                                    <div className="form__group">
                                        <label htmlFor="outputReceptor" className="form__group-label">
                                            Salida receptor
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="Salida"
                                                name="outputReceptor"
                                            />
                                        </label>
                                        {errors.outputReceptor && touched.outputReceptor ? (
                                            <div className="form__group-error">
                                                {errors.outputReceptor}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="form__group">
                                        <label htmlFor="multicastReceptor" className="form__group-label">
                                            Multicast Receptor
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="Multicast"
                                                name="multicastReceptor"
                                            />
                                        </label>
                                        {errors.multicastReceptor && touched.multicastReceptor ? (
                                            <div className="form__group-error">
                                                {errors.multicastReceptor}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="form__group">
                                        <label htmlFor="ipVideoMulticast" className="form__group-label">
                                            Ip Video Multicast
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="IP Video"
                                                name="ipVideoMulticast"
                                            />
                                        </label>
                                        {errors.ipVideoMulticast && touched.ipVideoMulticast ? (
                                            <div className="form__group-error">
                                                {errors.ipVideoMulticast}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="form__group">
                                        <label htmlFor="locationRow" className="form__group-label">
                                            Fila
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="Fila"
                                                name="locationRow"
                                            />
                                        </label>
                                        {errors.locationRow && touched.locationRow ? (
                                            <div className="form__group-error">
                                                {errors.locationRow}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="form__group">
                                        <label htmlFor="locationCol" className="form__group-label">
                                            Bastidor
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="Bastidor"
                                                name="locationCol"
                                            />
                                        </label>
                                        {errors.locationCol && touched.locationCol ? (
                                            <div className="form__group-error">
                                                {errors.locationCol}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>

                            <button type="submit" className={`${styles.button} btn-primary`}>
                                Enviar
                            </button>
                        </Form>
                    )}
                </Formik>
            </div>
        </>
    );
};

export default IrdForm;
