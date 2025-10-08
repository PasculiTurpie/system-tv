import React from "react";
import { Field, Form, Formik } from "formik";
import { Link } from "react-router-dom";
import * as Yup from "yup";
import Swal from "sweetalert2";

import api from "../../utils/api";
import stylesEquipment from "../Equipment/Equipment.module.css";

const SchemaTipoEquipos = Yup.object().shape({
    tipoNombre: Yup.string()
        .trim("No debe tener espacios al inicio o al final")
        .required("Campo obligatorio"),
});

const TipoEquipoForm = () => {
    return (
        <div className="outlet-main">
            <nav aria-label="breadcrumb">
                <ol className="breadcrumb">
                    <li className="breadcrumb-item">
                        <Link to="/list-type-equitment">Listar</Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                        Formulario
                    </li>
                </ol>
            </nav>


            <div className={stylesEquipment.tipo__section}>
                <hr className={stylesEquipment.section__divider} />

                <Formik
                    initialValues={{ tipoNombre: "" }}
                    validationSchema={SchemaTipoEquipos}
                    onSubmit={async (values, { resetForm, setSubmitting }) => {
                        const normalized = values.tipoNombre.trim().toLowerCase();

                        try {
                            setSubmitting(true);
                            await api.createTipoEquipo({ tipoNombre: normalized });
                            Swal.fire({
                                title: "Tipo de equipo guardado exitosamente",
                                icon: "success",
                                html: `<p><strong>Tipo:</strong> ${normalized}</p>`,
                            });
                            resetForm();
                        } catch (error) {
                            Swal.fire({
                                title: "Error",
                                icon: "error",
                                text: `Duplicidad de datos`,
                                footer: `${error.response?.data?.message || "Error desconocido"}`,
                            });
                        } finally {
                            setSubmitting(false);
                        }
                    }}
                >
                    {({ errors, touched, isSubmitting }) => (
                        <Form className="form__add">
                            <h1 className="form__titulo">Registrar Tipo Equipo</h1>
                            <div className={stylesEquipment.rows__group}>
                                <div className={stylesEquipment.columns__group}>
                                    <div className="form__group">
                                        <label htmlFor="tipoNombre" className="form__group-label">
                                            Tipo equipo
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="Tipo equipo"
                                                name="tipoNombre"
                                            />
                                        </label>
                                        {errors.tipoNombre && touched.tipoNombre && (
                                            <div className="form__group-error">{errors.tipoNombre}</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button type="submit" className="button btn-primary" disabled={isSubmitting}>
                                {isSubmitting ? "Guardando..." : "Enviar"}
                            </button>
                        </Form>
                    )}
                </Formik>
            </div>
        </div>
    );
};

export default TipoEquipoForm;
