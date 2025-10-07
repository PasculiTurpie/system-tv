import { useEffect, useState } from "react";
import api from "../../utils/api";
import { Formik, Form, Field } from "formik";
import * as Yup from "yup";
import Swal from "sweetalert2";
import stylesIrd from "./Ird.module.css";
import ModalComponent from "../../components/ModalComponent/ModalComponent";

const ipMulticastRegex =
    /^(2+(?:[0-4]\d|5[0-5])\.(?:[0-9]{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(?:[0-9]{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(?:[0-9]{1,2}|1\d\d|2[0-4]\d|25[0-5]))$/;

const ipVideoMulticast = /^(192.168)?\.(\d{1,3}\.)\d{1,3}$/;

const UpdateIrdSchema = Yup.object().shape({
    urlIrd: Yup.string().matches(/(?:https?:\/\/\w+\.\w+\.\w+.+)/, "Ingresa una url válida"),
    ipAdminIrd: Yup.string().matches(
        /^172\.19\.\d{1,3}\.\d{1,3}$/,
        "Ingresa una ip válida"
    ),
    nombreIrd: Yup.string(),
    marcaIrd: Yup.string(),
    modelIrd: Yup.string(),
    versionIrd: Yup.string(),
    uaIrd: Yup.string(),
    tidReceptor: Yup.string(),
    typeReceptor: Yup.string(),
    feqReceptor: Yup.string(),
    symbolRateIrd: Yup.string(),
    fecReceptorIrd: Yup.string(),
    modulationReceptorIrd: Yup.string(),
    rellOfReceptor: Yup.string(),
    nidReceptor: Yup.string(),
    cvirtualReceptor: Yup.string(),
    vctReceptor: Yup.string(),
    outputReceptor: Yup.string(),
    swAdmin: Yup.string(),
    portSw: Yup.string(),
    multicastReceptor: Yup.string().matches(
        ipMulticastRegex,
        "Debe ser una multicast válida"
    ),
    ipVideoMulticast: Yup.string().matches(
        ipVideoMulticast,
        "Debe ser una ip válida"
    ),
    locationRow: Yup.string().matches(/\d+/, "Ingrese un número"),
    locationCol: Yup.string().matches(/\d+/, "Ingrese un número"),
});

const ModalIrd = ({ itemId, modalOpen, setModalOpen, title, refreshList }) => {
    const [dataIrd, setDataIrd] = useState(null);

    useEffect(() => {
        if (itemId) {
             
            api.getIdIrd(itemId).then((res) => {
                 
                setDataIrd(res.data);
            });
        }
    }, [itemId]);

    if (!dataIrd) return null;
    return (
        <Formik
            initialValues={{
                urlIrd: dataIrd.urlIrd || "",
                nombreIrd:dataIrd.nombreIrd || "",
                ipAdminIrd: dataIrd.ipAdminIrd || "",
                marcaIrd: dataIrd.marcaIrd || "",
                modelIrd: dataIrd.modelIrd || "",
                versionIrd: dataIrd.versionIrd || "",
                uaIrd: dataIrd.uaIrd || "",
                tidReceptor: dataIrd.tidReceptor || "",
                typeReceptor: dataIrd.typeReceptor || "",
                feqReceptor: dataIrd.feqReceptor || "",
                symbolRateIrd: dataIrd.symbolRateIrd || "",
                fecReceptorIrd: dataIrd.fecReceptorIrd || "",
                modulationReceptorIrd: dataIrd.modulationReceptorIrd || "",
                rellOfReceptor: dataIrd.rellOfReceptor || "",
                nidReceptor: dataIrd.nidReceptor || "",
                cvirtualReceptor: dataIrd.cvirtualReceptor || "",
                vctReceptor: dataIrd.vctReceptor || "",
                outputReceptor: dataIrd.outputReceptor || "",
                swAdmin: dataIrd.swAdmin || "",
                portSw: dataIrd.portSw || "",
                multicastReceptor: dataIrd.multicastReceptor || "",
                ipVideoMulticast: dataIrd.ipVideoMulticast || "",
                locationRow: dataIrd.locationRow || "",
                locationCol: dataIrd.locationCol || "",
            }}
            validationSchema={UpdateIrdSchema}
            onSubmit={async (values, { resetForm }) => {
                try {
                    await api.updateIrd(itemId, values);
                     
                    Swal.fire({
                        icon: "success",
                        title: "Equipo actualizado",
                        text: "El equipo se ha actualizado exitosamente!",
                        footer: `<h4>${values.nombreIrd}</h4>
                        <h4>${values.modelIrd}</h4>
                        
                        `,
                    });
                    refreshList();
                    setModalOpen(false);
                    resetForm();
                } catch (error) {
                    Swal.fire({
                        icon: "error",
                        title: "Ups!!",
                        text: `${
                            error.response?.data?.message || "Error desconocido"
                        }`,
                    });
                    console.error(error);
                }
            }
            }
        >
            {({ errors, touched }) => (
                <ModalComponent
                    modalOpen={modalOpen}
                    title={title}
                    setModalOpen={setModalOpen}
                >
                    <Form className="form__add">
                        <div className={stylesIrd.rows__group}>
                            <div className={stylesIrd.columns__group}>
                                <div className="form__group">
                                    <label
                                        htmlFor="typeReceptor"
                                        className="form__group-label"
                                    >
                                        Url imagen
                                        <br />
                                        <Field
                                            type="text"
                                            className="form__group-input"
                                            placeholder="Nombre"
                                            name="urlIrd"
                                        />
                                    </label>
                                    {errors.urlIrd && touched.urlIrd ? (
                                        <div className="form__group-error">
                                            {errors.urlIrd}
                                        </div>
                                    ) : null}
                                </div>
                                <div className="form__group">
                                    <label
                                        htmlFor="nombreIrd"
                                        className="form__group-label"
                                    >
                                        Nombre Ird
                                        <br />
                                        <Field
                                            type="text"
                                            className="form__group-input"
                                            placeholder="Nombre Ird"
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
                                    <label
                                        htmlFor="typeReceptor"
                                        className="form__group-label"
                                    >
                                        Marca
                                        <br />
                                        <Field
                                            type="text"
                                            className="form__group-input"
                                            placeholder="Nombre"
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
                                    <label
                                        htmlFor="modelIrd"
                                        className="form__group-label"
                                    >
                                        Modelo
                                        <br />
                                        <Field
                                            type="text"
                                            className="form__group-input"
                                            placeholder="Nombre"
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
                                    <label
                                        htmlFor="ipAdminIrd"
                                        className="form__group-label"
                                    >
                                        Ip administración
                                        <br />
                                        <Field
                                            type="text"
                                            className="form__group-input"
                                            placeholder="Nombre"
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
                                    <label
                                        htmlFor="marcaIrd"
                                        className="form__group-label"
                                    >
                                        Versión
                                        <br />
                                        <Field
                                            type="text"
                                            className="form__group-input"
                                            placeholder="Nombre"
                                            name="versionIrd"
                                        />
                                    </label>

                                    {errors.versionIrd && touched.versionIrd ? (
                                        <div className="form__group-error">
                                            {errors.versionIrd}
                                        </div>
                                    ) : null}
                                </div>
                                
                            </div>
                            {/* ########################################## */}
                            <div className={stylesIrd.columns__group}>
                                <div className="form__group">
                                    <label
                                        htmlFor="uaIrd"
                                        className="form__group-label"
                                    >
                                        TID
                                        <br />
                                        <Field
                                            type="text"
                                            className="form__group-input"
                                            placeholder="Nombre"
                                            name="tidReceptor"
                                        />
                                    </label>

                                    {errors.tidReceptor &&
                                    touched.tidReceptor ? (
                                        <div className="form__group-error">
                                            {errors.tidReceptor}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="form__group">
                                    <label
                                        htmlFor="tidReceptor"
                                        className="form__group-label"
                                    >
                                        Tipo receptor
                                        <br />
                                        <Field
                                            type="text"
                                            className="form__group-input"
                                            placeholder="Nombre"
                                            name="typeReceptor"
                                        />
                                    </label>

                                    {errors.typeReceptor &&
                                    touched.typeReceptor ? (
                                        <div className="form__group-error">
                                            {errors.typeReceptor}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="form__group">
                                    <label
                                        htmlFor="feqReceptor"
                                        className="form__group-label"
                                    >
                                        Frecuencia
                                        <br />
                                        <Field
                                            type="text"
                                            className="form__group-input"
                                            placeholder="Nombre"
                                            name="feqReceptor"
                                        />
                                    </label>

                                    {errors.feqReceptor &&
                                    touched.feqReceptor ? (
                                        <div className="form__group-error">
                                            {errors.feqReceptor}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="form__group">
                                    <label
                                        htmlFor="symbolRateIrd"
                                        className="form__group-label"
                                    >
                                        Symbol Rate
                                        <br />
                                        <Field
                                            type="text"
                                            className="form__group-input"
                                            placeholder="Nombre"
                                            name="symbolRateIrd"
                                        />
                                    </label>

                                    {errors.symbolRateIrd &&
                                    touched.symbolRateIrd ? (
                                        <div className="form__group-error">
                                            {errors.symbolRateIrd}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="form__group">
                                    <label
                                        htmlFor="fecReceptorIrd"
                                        className="form__group-label"
                                    >
                                        FEC
                                        <br />
                                        <Field
                                            type="text"
                                            className="form__group-input"
                                            placeholder="Nombre"
                                            name="fecReceptorIrd"
                                        />
                                    </label>

                                    {errors.fecReceptorIrd &&
                                    touched.fecReceptorIrd ? (
                                        <div className="form__group-error">
                                            {errors.fecReceptorIrd}
                                        </div>
                                    ) : null}
                                </div>
                                <div className="form__group">
                                    <label
                                        htmlFor="versionIrd"
                                        className="form__group-label"
                                    >
                                        UA
                                        <br />
                                        <Field
                                            type="text"
                                            className="form__group-input"
                                            placeholder="Nombre"
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
                            {/* ###################################### */}

                            <div className={stylesIrd.columns__group}>
                                <div className="form__group">
                                    <label
                                        htmlFor="modulationReceptorIrd"
                                        className="form__group-label"
                                    >
                                        Modulación
                                        <br />
                                        <Field
                                            type="text"
                                            className="form__group-input"
                                            placeholder="Nombre"
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
                                    <label
                                        htmlFor="rellOfReceptor"
                                        className="form__group-label"
                                    >
                                        Roll Of
                                        <br />
                                        <Field
                                            type="text"
                                            className="form__group-input"
                                            placeholder="Nombre"
                                            name="rellOfReceptor"
                                        />
                                    </label>

                                    {errors.rellOfReceptor &&
                                    touched.rellOfReceptor ? (
                                        <div className="form__group-error">
                                            {errors.rellOfReceptor}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="form__group">
                                    <label
                                        htmlFor="nidReceptor"
                                        className="form__group-label"
                                    >
                                        Nid
                                        <br />
                                        <Field
                                            type="text"
                                            className="form__group-input"
                                            placeholder="Nombre"
                                            name="nidReceptor"
                                        />
                                    </label>

                                    {errors.nidReceptor &&
                                    touched.nidReceptor ? (
                                        <div className="form__group-error">
                                            {errors.nidReceptor}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="form__group">
                                    <label
                                        htmlFor="cvirtualReceptor"
                                        className="form__group-label"
                                    >
                                        Canal Virtual
                                        <br />
                                        <Field
                                            type="text"
                                            className="form__group-input"
                                            placeholder="Nombre"
                                            name="cvirtualReceptor"
                                        />
                                    </label>

                                    {errors.cvirtualReceptor &&
                                    touched.cvirtualReceptor ? (
                                        <div className="form__group-error">
                                            {errors.cvirtualReceptor}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="form__group">
                                    <label
                                        htmlFor="vctReceptor"
                                        className="form__group-label"
                                    >
                                        VCT
                                        <br />
                                        <Field
                                            type="text"
                                            className="form__group-input"
                                            placeholder="Nombre"
                                            name="vctReceptor"
                                        />
                                    </label>

                                    {errors.vctReceptor &&
                                    touched.vctReceptor ? (
                                        <div className="form__group-error">
                                            {errors.vctReceptor}
                                        </div>
                                    ) : null}
                                </div>
                                <div className="form__group">
                                    <label
                                        htmlFor="swAdmin"
                                        className="form__group-label"
                                    >
                                        SW Admin
                                        <br />
                                        <Field
                                            type="text"
                                            className="form__group-input"
                                            placeholder="SW Admin"
                                            name="swAdmin"
                                        />
                                    </label>

                                    {errors.swAdmin &&
                                        touched.swAdmin ? (
                                        <div className="form__group-error">
                                            {errors.swAdmin}
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            {/* ###################################### */}
                            <div className={stylesIrd.columns__group}>
                                <div className="form__group">
                                    <label
                                        htmlFor="outputReceptor"
                                        className="form__group-label"
                                    >
                                        Salida
                                        <br />
                                        <Field
                                            type="text"
                                            className="form__group-input"
                                            placeholder="Nombre"
                                            name="outputReceptor"
                                        />
                                    </label>

                                    {errors.outputReceptor &&
                                    touched.outputReceptor ? (
                                        <div className="form__group-error">
                                            {errors.outputReceptor}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="form__group">
                                    <label
                                        htmlFor="multicastReceptor"
                                        className="form__group-label"
                                    >
                                        Multicast Receptor
                                        <br />
                                        <Field
                                            type="text"
                                            className="form__group-input"
                                            placeholder="Nombre"
                                            name="multicastReceptor"
                                        />
                                    </label>

                                    {errors.multicastReceptor &&
                                    touched.multicastReceptor ? (
                                        <div className="form__group-error">
                                            {errors.multicastReceptor}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="form__group">
                                    <label
                                        htmlFor="ipVideoMulticast"
                                        className="form__group-label"
                                    >
                                        Ip Video Multicast
                                        <br />
                                        <Field
                                            type="text"
                                            className="form__group-input"
                                            placeholder="Nombre"
                                            name="ipVideoMulticast"
                                        />
                                    </label>

                                    {errors.ipVideoMulticast &&
                                    touched.ipVideoMulticast ? (
                                        <div className="form__group-error">
                                            {errors.ipVideoMulticast}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="form__group">
                                    <label
                                        htmlFor="locationRow"
                                        className="form__group-label"
                                    >
                                        Fila
                                        <br />
                                        <Field
                                            type="text"
                                            className="form__group-input"
                                            placeholder="Nombre"
                                            name="locationRow"
                                        />
                                    </label>

                                    {errors.locationRow &&
                                    touched.locationRow ? (
                                        <div className="form__group-error">
                                            {errors.locationRow}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="form__group">
                                    <label
                                        htmlFor="locationCol"
                                        className="form__group-label"
                                    >
                                        Bastidor
                                        <br />
                                        <Field
                                            type="text"
                                            className="form__group-input"
                                            placeholder="Nombre"
                                            name="locationCol"
                                        />
                                    </label>

                                    {errors.locationCol &&
                                    touched.locationCol ? (
                                        <div className="form__group-error">
                                            {errors.locationCol}
                                        </div>
                                    ) : null}
                                </div>
                                <div className="form__group">
                                    <label
                                        htmlFor="portSw"
                                        className="form__group-label"
                                    >
                                        SW Port
                                        <br />
                                        <Field
                                            type="text"
                                            className="form__group-input"
                                            placeholder="SW Port"
                                            name="portSw"
                                        />
                                    </label>

                                    {errors.portSw &&
                                        touched.portSw ? (
                                        <div className="form__group-error">
                                            {errors.portSw}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className={`${stylesIrd.button} btn-primary`}
                        >
                            Enviar
                        </button>
                    </Form>
                </ModalComponent>
            )}
        </Formik>
    );
};

export default ModalIrd;
